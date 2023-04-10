import { ethers } from "ethers";
import { AAUtils } from "./AAUtils"
import { UserOperation } from '../tools/UserOperation'
import { fillAndSign } from '../tools/UserOp'
import { calcGasUsage } from '../tools/testutils'
import dotenv from 'dotenv'
import CounterInfo from '../../abi/TestCounter.json'
dotenv.config();

const provider = new ethers.providers.JsonRpcProvider(
    `${process.env.SEPOLIA_RPC_URL_HTTP}`
);

/*  const provider = new ethers.providers.JsonRpcProvider(
  `http://127.0.0.1:8545/`
);  */

const secretkey = process.env.WALLET_PRIVATE_KEY_DEV1;  // signer setting
//const secretkey = process.env.LOCAL_WALLET_PRIVATE_KEY
const walletObj = new ethers.Wallet(secretkey!);
const ethersSigner = walletObj.connect(provider);


async function main() {
    

    const entrypointAddr = "0xfCe26050ba553C1d0e838f280E2F7dD47E84ff52"
    const paymasterAddr = "0x5EFd9daF4Dfe4c0E5B850FFc9311402348b4c325"
    const factroyAddr = "0x26DAa668A5a07eafa8536a2665D8D35454674f45"

    
    const AA = new AAUtils(ethersSigner,entrypointAddr,paymasterAddr,factroyAddr)
    if (await AA.paymasterDeposit() == '0') {
        await AA.depositToPaymaster("0.01")
    }

    /* 지갑 생성 */
    //await createExample(AA)

    /* counter contract에 트랜잭션 보내기 */
    //await callExample(AA)
    const rcpt = await AA.changeOwnerOfPaymaster("0xC965377Ef36137fa85c582e3D404160D0C229AB3");
    console.log(rcpt)
}

// 지갑 생성 예제
async function createExample(AA: AAUtils) {
    let createOp: UserOperation

    const owenerAddress = ethersSigner.address  // 컨트랙트 지갑 소유자 설정

    createOp = await AA.createAccountOp(owenerAddress, 9)
    
    console.log("contract wallet address:", createOp.sender)
    
    const msg = await AA.createMessageFromOp(createOp)
    const signature = await ethersSigner.signMessage(msg) // 프런트에서 서명
    createOp = AA.addSignatureToOp(createOp, signature)
        

    console.log("op is", createOp)

    await AA.mintToken(createOp.sender, '1')  // 컨트랙트 지갑에 토큰 발행 
    console.log("======== mint succeed ========")

    const beneficiaryAddress = "0xc75C8C7f741a312Ba9f5E6725cf837EcB379054D"
    const rcpt = await AA.handleOp(createOp, beneficiaryAddress);  // op 실행

    console.log('\t== create gasUsed=', rcpt.gasUsed.toString())
      
}

// 다른 contract 호출 예제 
async function callExample(AA: AAUtils) {
    let op : UserOperation
    const wallet = "0x89EE278F1B80Bb6329D0131d4415f0c9d06c7fDB" // 컨트랙트 지갑 주소
    const CounterContract = new ethers.Contract("0xE141141bE0982b16962f7595685feECD2e1d8978", CounterInfo.abi, ethersSigner)
    const count = await CounterContract.populateTransaction.count()
    const calldata = await AA.generateExecutionCalldata(ethersSigner, wallet, CounterContract.address, count.data!)

    op = await AA.createOp({
        sender: wallet,
        callData: calldata,
        paymasterAndData: AA.paymaster.address,
        verificationGasLimit: 1e6,
        callGasLimit: 1e6
    })

    const msg = await AA.createMessageFromOp(op)
    const signature = await ethersSigner.signMessage(msg) // 프런트에서 서명
    op = AA.addSignatureToOp(op, signature)
    
    
    await AA.mintToken(op.sender, '1')  // 컨트랙트 지갑에 토큰 발행 
    console.log("======== mint succeed ========")
    console.log("op is", op)

    console.log("count before op: ", await CounterContract.counters(wallet))

    const beneficiaryAddress = "0xc75C8C7f741a312Ba9f5E6725cf837EcB379054D"
    const rcpt = await AA.handleOp(op, beneficiaryAddress);  // op 실행

    console.log("count after op: ", await CounterContract.counters(wallet))

    console.log('\t== call gasUsed=', rcpt.gasUsed.toString())
      

}



main().then(
    () => process.exit(),
    err => {
        console.error(err);
        process.exit(-1);
    },
);