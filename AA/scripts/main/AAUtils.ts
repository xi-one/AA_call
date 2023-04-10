import { ethers, Wallet, Contract, PopulatedTransaction } from 'ethers'
import { hexConcat, parseEther, hexValue, arrayify } from 'ethers/lib/utils'
import {
    EntryPoint,
    EntryPoint__factory,
    TokenPaymaster__factory,
    TokenPaymaster,
    SimpleAccountFactory__factory,
    SimpleAccountFactory,
    SimpleAccount__factory,
    SimpleAccount
} from '../../typechain-types'
import { UserOperation } from '../tools/UserOperation'
import { fillAndSign, getUserOpHash, fillUserOp } from '../tools/UserOp'
import { rethrow } from '../tools/testutils'

export class AAUtils {
    entrypoint: EntryPoint;
    paymaster: TokenPaymaster;
    accountfactory: SimpleAccountFactory;

    constructor(etherSigner: Wallet, entrypointAddress: string, paymaterAddress: string, accountfactoryAddress: string) {
            this.entrypoint = EntryPoint__factory.connect(entrypointAddress, etherSigner);
            this.paymaster = TokenPaymaster__factory.connect(paymaterAddress, etherSigner);
            this.accountfactory = SimpleAccountFactory__factory.connect(accountfactoryAddress, etherSigner);
    }

    // paymater 예치 함수 (value: ether 단위)
    async depositToPaymaster(value: string) {
        await this.entrypoint.depositTo(this.paymaster.address, { value: parseEther(value) })
    }

    async stakePaymaster() {
        await this.paymaster.addStake(1, { value: parseEther('0.001') })
    }

    async paymasterDeposit(): Promise<string> {
        const ret = await this.entrypoint.balanceOf(this.paymaster.address)

        return ret.toString()
    }

    async checkTokenDeposit(address: string): Promise<string> {
        const deposit = await this.paymaster.balanceOf(address)
        return deposit.toString()
    }

    // paymater Token 발행 해주는 함수 
    async mintToken(address: string, amount: string) {
        await this.paymaster.mintTokens(address, parseEther(amount))
    }

    // 컨트랙트 지갑 생성 op 객체 : 생성된 지갑 컨트랙트의 주소를 알고 싶은 땐, op 객체의 sender를 확인
    async createAccountOp(owner: string, salt: number = 0): Promise<UserOperation> {

        const createOp = await this.createOp({
            initCode: this.getAccountDeployer(owner, salt),
            verificationGasLimit: 2e6,
            paymasterAndData: this.paymaster.address,
            nonce: 0
        })

        return createOp
    }

    //op을 실행하는 함수 (beneficiaryAddress: 트랜잭션에 대한 수수료를 환불받을 주소)
    async handleOp(op: UserOperation, beneficiaryAddress: string) {
        const gasPrice = await this.entrypoint.provider.getGasPrice()
        const maxFeePerGas = gasPrice.mul(2) // 기존 가스 가격의 두 배
        const maxPriorityFeePerGas = gasPrice.mul(2) // 기존 가스 가격의 두 배
        const rcpt = await this.entrypoint.handleOps([op], beneficiaryAddress, {
            gasLimit: 1e7
          }).catch(rethrow()).then(async tx => await tx!.wait())
        
        return rcpt;
    }

    // account contract execute calldata 
    async generateExecutionCalldata(etherSigner: Wallet, walletAddress: string, contractAddress: string, data: string, value: number = 0): Promise<string> {
        let account: SimpleAccount
        let accountExecFromEntryPoint: PopulatedTransaction
        account = SimpleAccount__factory.connect(walletAddress, etherSigner)
        
        accountExecFromEntryPoint = await account.populateTransaction.execute(contractAddress, value, data)

        return accountExecFromEntryPoint.data!
    }


    // 지갑 생성시 initcode 만들어주는 함수 
    getAccountDeployer (accountOwner: string, _salt: number = 0): string {
        return hexConcat([
          this.accountfactory.address,
          hexValue(this.accountfactory.interface.encodeFunctionData('createAccount', [accountOwner, _salt])!)
        ])
    }


    // op 객체 채워주는 함수 (signature 항목은 빠져있음)
    async createOp(op: Partial<UserOperation>): Promise<UserOperation>{
        const op2 = await fillUserOp(op, this.entrypoint)

        return op2
    }

    // 서명할 message 만들어주는 함수 
    async createMessageFromOp(op: UserOperation): Promise<Uint8Array> {
        const provider = this.entrypoint.provider

        const chainId = await provider!.getNetwork().then(net => net.chainId)
        const message = arrayify(getUserOpHash(op, this.entrypoint.address, chainId))

        return message
    }

    public addSignatureToOp(op: UserOperation, signature: string): UserOperation {
        return {
            ...op,
            signature: signature
          }
    }

}