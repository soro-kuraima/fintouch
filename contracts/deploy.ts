import { LendingPool } from './src/contracts/contracts'
import { Provider, TransactionResponse, UtxoQueryOptions, TxHash, bsv, AddressOption, TestWallet, toByteString, PubKey, SmartContract, MethodCallOptions, ContractTransaction } from 'scrypt-ts'
import * as dotenv from 'dotenv';

class FractalProvider extends Provider {
    private network: bsv.Networks.Network
    private isReady: boolean = false
    private apiKey: string
    private baseURL: string = 'https://open-api-fractal-testnet.unisat.io/v1/indexer'
    private wallet: TestWallet | undefined

    constructor(network: bsv.Networks.Network = bsv.Networks.testnet, apiKey: string) {
        super()
        this.network = network
        this.apiKey = apiKey
        this._initializeConnection()
    }

    isConnected(): boolean {
        return this.isReady
    }

    async connect(): Promise<this> {
        interface BlockchainInfo {
            code: number;
            msg: string;
            data: {
                chain: string;
                blocks: number;
                headers: number;
                bestBlockHash: string;
                prevBlockHash: string;
                difficulty: string;
                medianTime: number;
                chainwork: string;
            };
        }

        try {
            const response = await fetch(`${this.baseURL}/blockchain/info`, {
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                }
            })

            const data = await response.json() as BlockchainInfo

            if (data.code !== 0) {
                throw new Error(`Failed to connect: ${data.msg} (code: ${data.code})`)
            }

            // Verify we're on the correct network
            const isTestnet = data.data.chain === 'test'
            if (isTestnet !== (this.network === bsv.Networks.testnet)) {
                throw new Error(`Network mismatch: Provider is on ${data.data.chain} but wallet is on ${this.network.name}`)
            }

            this.isReady = true
            console.log(`Connected to ${data.data.chain}net, height: ${data.data.blocks}`)
            
            return this
        } catch (error) {
            console.error('Connection error:', error)
            throw error
        }
    }

    async updateNetwork(network: bsv.Networks.Network): Promise<void> {
        this.network = network
    }

    getNetwork(): bsv.Networks.Network {
        return this.network
    }

    async getFeePerKb(): Promise<number> {
        return 500 // Standard fee
    }

    async sendRawTransaction(rawTxHex: string): Promise<TxHash> {
        interface BroadcastResponse {
            code: number;
            msg: string;
            data: string | null;
        }

        try {
            const response = await fetch(`${this.baseURL}/v1/indexer/local_pushtx`, {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    txHex: rawTxHex 
                })
            })

            const data = await response.json() as BroadcastResponse

            // Check for error codes
            if (data.code !== 0) {
                console.error('Broadcast error:', data)
                throw new Error(`Transaction broadcast failed: ${data.msg} (code: ${data.code})`)
            }

            if (!data.data) {
                throw new Error('Transaction broadcast succeeded but no txid returned')
            }

            return data.data
            
        } catch (error) {
            console.error('sendRawTransaction error:', error)
            throw error
        }
    }

    async getTransaction(txHash: TxHash): Promise<TransactionResponse> {
        interface TxResponse {
            code: number;
            msg: string;
            data: {
                detail: {
                    txid: string;
                    nIn: number;
                    nOut: number;
                    inSatoshi: number;
                    outSatoshi: number;
                    locktime: number;
                    size: number;
                    witOffset: number;
                    height: number;
                    idx: number;
                    blkid: string;
                    confirmations: number;
                    timestamp: number;
                };
                start: number;
                total: number;
            };
        }

        const response = await fetch(`${this.baseURL}/tx/${txHash}`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'accept': 'application/json'
            }
        })
        
        if (!response.ok) {
            throw new Error('Transaction fetch failed')
        }
        
        const data = await response.json() as TxResponse

        if (data.code !== 0) {
            throw new Error(`Transaction fetch failed: ${data.msg} (code: ${data.code})`)
        }
        
        return new bsv.Transaction(data.data.detail.txid) as TransactionResponse
    }

    async listUnspent(address: AddressOption, options?: UtxoQueryOptions): Promise<bsv.Transaction.IUnspentOutput[]> {
        try {
            const addressStr = address.toString()
            const response = await fetch(
                `${this.baseURL}/address/${addressStr}/utxo-data?cursor=0&size=50`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'accept': 'application/json'
                    }
                }
            )

            if (!response.ok) {
                throw new Error(`Failed to fetch UTXOs: ${response.statusText}`)
            }

            interface UTXOResponse {
                code: number;
                msg: string;
                data: {
                    cursor: number;
                    total: number;
                    totalConfirmed: number;
                    totalUnconfirmed: number;
                    totalUnconfirmedSpend: number;
                    utxo: Array<{
                        txid: string;
                        vout: number;
                        satoshi: number;
                        scriptPk: string;
                        height: number;
                        idx: number;
                        address: string;
                        codeType: number;
                        scriptType: string;
                        isOpInRBF: boolean;
                        inscriptions?: Array<{
                            inscriptionId: string;
                            inscriptionNumber: number;
                            isBRC20: boolean;
                            moved: boolean;
                            offset: number;
                        }>;
                    }>;
                };
            }

            const responseData = await response.json() as UTXOResponse
            return responseData.data.utxo.map((utxo) => ({
                txId: utxo.txid,
                outputIndex: utxo.vout,
                satoshis: utxo.satoshi,
                script: utxo.scriptPk,
            }))
        } catch (error) {
            console.error('listUnspent error:', error)
            throw error
        }
    }

    async getBalance(address?: AddressOption): Promise<{ confirmed: number; unconfirmed: number }> {
        try {
            const addressStr = address!.toString()
            const response = await fetch(
                `${this.baseURL}/address/${addressStr}/balance`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'accept': 'application/json'
                    }
                }
            )

            if (!response.ok) {
                throw new Error(`Failed to fetch balance: ${response.statusText}`)
            }

            interface BalanceResponse {
                code: number;
                msg: string;
                data: {
                    address: string;
                    satoshi: number;
                    pendingSatoshi: number;
                    utxoCount: number;
                    btcSatoshi: number;
                    btcPendingSatoshi: number;
                    btcUtxoCount: number;
                    inscriptionSatoshi: number;
                    inscriptionPendingSatoshi: number;
                    inscriptionUtxoCount: number;
                };
            }

            const data = await response.json() as BalanceResponse

            if (data.code !== 0) {
                throw new Error(`Balance fetch failed: ${data.msg} (code: ${data.code})`)
            }

            return {
                confirmed: data.data.satoshi,
                unconfirmed: data.data.pendingSatoshi
            }
            
        } catch (error) {
            console.error('getBalance error:', error)
            throw error
        }
    }

    async deployContract<T extends SmartContract>(
        contract: T, 
        amount: number
    ): Promise<{ txId: string; instance: T }> {
        if (!this.wallet) {
            throw new Error('No wallet connected to provider')
        }

        try {
            // Connect contract to wallet
            await contract.connect(this.wallet)

            // Deploy contract
            const deployTx = await contract.deploy(amount)
            console.log('Contract deployed:', deployTx.id)

            return {
                txId: deployTx.id,
                instance: contract
            }
        } catch (error) {
            console.error('Contract deployment failed:', error)
            throw error
        }
    }

    async callContract<T extends SmartContract>(
        contract: T,
        methodName: string,
        args: any[],
        options: MethodCallOptions<T>
    ): Promise<ContractTransaction> {
        if (!this.wallet) {
            throw new Error('No wallet connected to provider')
        }

        try {
            // Ensure contract is connected to wallet
            if (!contract.signer) {
                await contract.connect(this.wallet)
            }

            // Get the method to call
            const method = contract.methods[methodName]
            if (!method) {
                throw new Error(`Method ${methodName} not found on contract`)
            }

            // Call the contract method
            const { tx } = await method.call(contract, ...args, options)
            console.log(`Contract method ${methodName} called:`, tx.id)

            return tx
        } catch (error) {
            console.error('Contract call failed:', error)
            throw error
        }
    }

    async getContractInstance<T extends SmartContract>(
        contractClass: new (...args: any[]) => T,
        txId: string,
        outputIndex: number = 0
    ): Promise<T> {
        try {
            // Get transaction
            const tx = await this.getTransaction(txId)
            if (!tx) {
                throw new Error(`Transaction ${txId} not found`)
            }

            // Create instance from transaction
            const instance = contractClass.fromTx(tx, outputIndex)
            
            // Connect to wallet if available
            if (this.wallet) {
                await instance.connect(this.wallet)
            }

            return instance
        } catch (error) {
            console.error('Failed to get contract instance:', error)
            throw error
        }
    }

    setWallet(wallet: TestWallet) {
        this.wallet = wallet
    }
}

// Load env variables
dotenv.config()

async function main() {
    await LendingPool.compile()
    
    // Initialize private key and provider
    const privateKeyWIF = process.env.PRIVATE_KEY || ''
    const privateKey = bsv.PrivateKey.fromWIF(privateKeyWIF)
    const apiKey = process.env.FRACTAL_API_KEY || ''
    const publicKey = process.env.PUBLIC_KEY || '';
    const provider = new FractalProvider(
        bsv.Networks.testnet, 
        apiKey
    )
    
    // Initialize wallet with the correct address
    const address = privateKey.toAddress().toHex()
    console.log('Using address:', address.toString())
    const wallet = new TestWallet(privateKey, provider)

    // Get public key from private key
    const ownerPubKey = PubKey(toByteString(privateKey.publicKey.toHex()))
    console.log(ownerPubKey);
    const rewardPoolPubKey = ownerPubKey  // Using same public key for reward pool
    const baseRewardRate = BigInt(process.env.BASE_REWARD_RATE || '200')

    try {
        await provider.connect()
        
        const instance = new LendingPool(
            ownerPubKey,
            rewardPoolPubKey,
            baseRewardRate
        )

        // Connect wallet
        await instance.connect(wallet)

        // Contract deployment
        const deployTx = await instance.deploy()
        console.log('LendingPool contract deployed: ', deployTx.id)

        // Wait for deployment confirmation
        console.log('Deployment confirmed!')
        
        // Log contract details
        console.log('Contract ID: ', instance)
        console.log('Contract Owner: ', process.env.PUBLIC_KEY)
        console.log('Reward Pool: ', process.env.REWARD_POOL_PUBLIC_KEY)
        console.log('Base Reward Rate: ', process.env.BASE_REWARD_RATE, 'basis points')

    } catch (error) {
        console.error('Deployment Error:', error)
        process.exit(1)
    }
}

main()