import { Blockchain } from '@shared/types';

export const SUPPORTED_CHAINS: Blockchain[] = [
  'UNI-SEPOLIA',
  'ETH-SEPOLIA', 
  'AVAX-FUJI',
  'MATIC-AMOY',
  'ARB-SEPOLIA'
];

export const CHAIN_NAMES: Record<Blockchain, string> = {
  'UNI-SEPOLIA': 'Unichain Sepolia',
  'ETH-SEPOLIA': 'Ethereum Sepolia',
  'AVAX-FUJI': 'Avalanche Fuji',
  'MATIC-AMOY': 'Polygon Amoy',
  'ARB-SEPOLIA': 'Arbitrum Sepolia'
};

// Circle's Token IDs for the API
export const USDC_TOKEN_IDS: Record<Blockchain, string> = {
  'UNI-SEPOLIA': '13ef30cd-309b-5c41-98cc-0fd68c4c8c44', 
  'ETH-SEPOLIA': '63086b75-1a89-52c9-9f7f-3229c6b4419b',
  'AVAX-FUJI': 'bf5df03b-356f-5bd9-81fd-30d0329f7d8f',
  'MATIC-AMOY': '922d8563-debf-5c11-af75-85ea9ce68d64',
  'ARB-SEPOLIA': '09d9e0b9-e9a1-5b3c-9c7f-d7bde746e7e2'
};

// USDC Contract Addresses
export const USDC_CONTRACT_ADDRESSES: Record<Blockchain, string> = {
  'UNI-SEPOLIA': '0x31d0220469e10c4E71834a79b1f276d740d3768F',
  'ETH-SEPOLIA': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  'AVAX-FUJI': '0x5425890298aed601595a70ab815c96711a31bc65',
  'MATIC-AMOY': '0x9999f7Fea5938fD3b1E26A12c3f2fb024e194f97',
  'ARB-SEPOLIA': '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'
};

// TokenMessenger Contract Addresses
export const TOKEN_MESSENGER_ADDRESSES: Record<Blockchain, string> = {
  'UNI-SEPOLIA': '0x8ed94B8dAd2Dc5453862ea5e316A8e71AAed9782',
  'ETH-SEPOLIA': '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  'AVAX-FUJI': '0xeb08f243e5d3fcff26a9e38ae5520a669f4019d0',
  'MATIC-AMOY': '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  'ARB-SEPOLIA': '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5'
};

// Chain Domain IDs
export const CHAIN_DOMAINS: Record<Blockchain, number> = {
  'UNI-SEPOLIA': 10,
  'ETH-SEPOLIA': 0,
  'AVAX-FUJI': 1,
  'MATIC-AMOY': 7,
  'ARB-SEPOLIA': 3
};