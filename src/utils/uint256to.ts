'use client'

// utils.ts

// Function to convert Wei to ETH
export const weiToEth = (weiAmount: bigint | number | string): string => {
    const wei = typeof weiAmount === 'bigint' ? weiAmount : BigInt(weiAmount);
    const eth = Number(wei) / 10**18;
    return eth.toFixed(6); // Adjust the number of decimal places as needed
};
export const weiToDawei = (weiAmount: bigint | number | string): string => {
    const wei = typeof weiAmount === 'bigint' ? weiAmount : BigInt(weiAmount);
    const eth = Number(wei) / 10**18;
    return eth.toFixed(4); // Adjust the number of decimal places as needed
};
// Example usage:
// const priceInWei = BigInt('180000000000000');
// const priceInEth = weiToEth(priceInWei);
// console.log(priceInEth); // Outputs: 0.180000

// Function to convert Wei to Gwei
export const weiToGwei = (weiAmount: bigint | number | string): string => {
    const wei = typeof weiAmount === 'bigint' ? weiAmount : BigInt(weiAmount);
    const gwei = Number(wei) / 10**9;
    return gwei.toFixed(2); // Adjust the number of decimal places as needed
};

// Example usage:
// const priceInWei = BigInt('180000000000000');
// const priceInGwei = weiToGwei(priceInWei);
// console.log(priceInGwei); // Outputs: 180.00

// Add more functions for other units as needed
