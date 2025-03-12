import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Pads an Ethereum address to bytes32 format
 * @param address The Ethereum address to pad
 * @returns The padded address as bytes32
 */
export function padAddressToBytes32(address: string): string {
  // Remove '0x' prefix if present and convert to lowercase
  const cleanAddress = address.toLowerCase().replace('0x', '');

  // Pad with zeros until we have 64 characters (32 bytes)
  const padded = cleanAddress.padStart(64, '0');

  // Add '0x' prefix back
  return '0x' + padded;
}