import { ethers } from 'ethers'
import { Wallet } from 'ethers'
export interface DebugLog {
  pc: number
  op: string
  gasCost: number
  depth: number
  stack: string[]
  memory: string[]
}

export interface DebugTransactionResult {
  gas: number
  failed: boolean
  returnValue: string
  structLogs: DebugLog[]
}
/* 
export async function debugTransaction (signer: Wallet, txHash: string, disableMemory = true, disableStorage = true): Promise<DebugTransactionResult> {
  const debugTx = async (hash: string): Promise<DebugTransactionResult> => await ethers.provider.send('debug_traceTransaction', [hash, {
    disableMemory,
    disableStorage
  }])

  return await debugTx(txHash)
} */
