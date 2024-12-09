// /hooks/useUnisat.ts
import { useState } from 'react';

export interface UnisatState {
  address: string;
  connected: boolean;
  network: string;
}

export const useUnisat = () => {
  const [state, setState] = useState<UnisatState>({
    address: '',
    connected: false,
    network: ''
  });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const connect = async () => {
    try {
      setLoading(true);
      if (typeof window.unisat === 'undefined') {
        throw new Error('Please install UniSat wallet');
      }

      const accounts = await window.unisat.requestAccounts();
      const network = await window.unisat.getNetwork();

      setState({
        address: accounts[0],
        connected: true,
        network
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { ...state, error, loading, connect };
};