import { LendingPool } from './src/contracts/contracts'
import { Provider, TransactionResponse, UtxoQueryOptions, TxHash, bsv, AddressOption, TestWallet, toByteString, PubKey } from 'scrypt-ts'
import * as dotenv from 'dotenv';

class FractalProvider extends Provider {
    private network: bsv.Networks.Network
    private isReady: boolean = false
    private apiKey: string
    private baseURL: string = 'https://open-api-fractal-testnet.unisat.io/v1/indexer'

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
        try {
            const response = await fetch(`${this.baseURL}/info`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'accept': 'application/json'
                }
            })
            if (response.ok) {
                this.isReady = true
            }
        } catch (error) {
            this.isReady = false
            throw new Error(`Connection failed: ${error}`)
        }
        return this
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
        const response = await fetch(`${this.baseURL}/tx/broadcast`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify({ txHex: rawTxHex })
        })
        
        if (!response.ok) {
            const error = await response.text()
            throw new Error(`Transaction broadcast failed: ${error}`)
        }
        
        const data = await response.json()
        return data.txid
    }

    async getTransaction(txHash: TxHash): Promise<TransactionResponse> {
        const response = await fetch(`${this.baseURL}/tx/${txHash}`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'accept': 'application/json'
            }
        })
        
        if (!response.ok) {
            throw new Error('Transaction fetch failed')
        }
        
        const data = await response.json()
        return new bsv.Transaction(data.hex) as TransactionResponse
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

            const responseData = await response.json()
            return responseData.data.map((utxo: any) => ({
                txId: utxo.txid,
                outputIndex: utxo.vout,
                satoshis: utxo.value,
                script: bsv.Script.buildPublicKeyHashOut(address).toHex(),
            }))
        } catch (error) {
            console.error('listUnspent error:', error)
            throw error
        }
    }

    async getBalance(address?: AddressOption): Promise<{ confirmed: number; unconfirmed: number }> {
        try {
            const utxos = await this.listUnspent(address!)
            const confirmed = utxos.reduce((sum, utxo) => sum + utxo.satoshis, 0)
            return {
                confirmed,
                unconfirmed: 0
            }
        } catch (error) {
            console.error('getBalance error:', error)
            throw error
        }
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