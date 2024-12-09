// /types/fractal.ts
interface InscriptionUtxo {
    inscriptionId: string;
    inscriptionNumber: number;
    isBRC20: boolean;
    moved: boolean;
    offset: number;
}

interface Utxo {
    address: string;
    codeType: number;
    height: number;
    idx: number;
    inscriptions: InscriptionUtxo[];
    isOpInRBF: boolean;
    satoshi: number;
    scriptPk: string;
    scriptType: string;
    txid: string;
    vout: number;
}

interface Inscription {
    address: string;
    inscriptionId: string;
    inscriptionNumber: number;
    contentType: string;
    contentLength: number;
    offset: number;
    timestamp: number;
    utxo: Utxo;
}

interface GetInscriptionsAPIResponse {
    code: number;
    msg: string;
    data: {
        cursor: number;
        total: number;
        totalConfirmed: number;
        totalUnconfirmed: number;
        totalUnconfirmedSpend: number;
        inscription: Inscription[];
    };
}

export type { InscriptionUtxo, Utxo, Inscription, GetInscriptionsAPIResponse };