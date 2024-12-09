// types/global.d.ts
interface Window {
    unisat: {
      requestAccounts: () => Promise<string[]>;
      switchNetwork: (network: string) => Promise<void>;
      getNetwork: () => Promise<string>;
      inscribe: (params: { content: string; contentType: string }) => Promise<string>;
      sendBitcoin: (address: string, amount: number) => Promise<string>;
    };
  }