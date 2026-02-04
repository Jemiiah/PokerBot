import {
  createWalletClient,
  createPublicClient,
  http,
  type WalletClient,
  type PublicClient,
  type Chain,
  type Account,
  formatEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../utils/config.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('WalletManager');

// Define Monad testnet chain
const monadTestnet: Chain = {
  id: config.chainId,
  name: 'Monad Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Monad',
    symbol: 'MON',
  },
  rpcUrls: {
    default: { http: [config.rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: 'https://testnet.monadexplorer.com' },
  },
};

export class WalletManager {
  private walletClient: WalletClient;
  private publicClient: PublicClient;
  private account: Account;

  constructor() {
    this.account = privateKeyToAccount(config.privateKey);

    this.publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(config.rpcUrl),
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain: monadTestnet,
      transport: http(config.rpcUrl),
    });

    logger.info({ address: this.account.address }, 'Wallet initialized');
  }

  get address(): `0x${string}` {
    return this.account.address;
  }

  get wallet(): WalletClient {
    return this.walletClient;
  }

  get client(): PublicClient {
    return this.publicClient;
  }

  get chain(): Chain {
    return monadTestnet;
  }

  get walletAccount(): Account {
    return this.account;
  }

  async getBalance(): Promise<bigint> {
    const balance = await this.publicClient.getBalance({
      address: this.account.address,
    });
    logger.debug({ balance: formatEther(balance) }, 'Balance fetched');
    return balance;
  }

  async getFormattedBalance(): Promise<string> {
    const balance = await this.getBalance();
    return formatEther(balance);
  }

  async signMessage(message: string): Promise<`0x${string}`> {
    return this.walletClient.signMessage({
      account: this.account,
      message,
    });
  }

  async sendTransaction(params: {
    to: `0x${string}`;
    value?: bigint;
    data?: `0x${string}`;
  }): Promise<`0x${string}`> {
    const hash = await this.walletClient.sendTransaction({
      account: this.account,
      chain: monadTestnet,
      to: params.to,
      value: params.value,
      data: params.data,
    });

    logger.info({ hash }, 'Transaction sent');
    return hash;
  }

  async waitForTransaction(hash: `0x${string}`) {
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    logger.info(
      { hash, status: receipt.status, gasUsed: receipt.gasUsed.toString() },
      'Transaction confirmed'
    );
    return receipt;
  }

  async getNonce(): Promise<number> {
    return this.publicClient.getTransactionCount({
      address: this.account.address,
    });
  }

  async estimateGas(params: {
    to: `0x${string}`;
    value?: bigint;
    data?: `0x${string}`;
  }): Promise<bigint> {
    return this.publicClient.estimateGas({
      account: this.account,
      ...params,
    });
  }
}
