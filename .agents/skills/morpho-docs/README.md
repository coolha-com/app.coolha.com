# Morpho Protocol

> Morpho is a decentralized lending protocol providing isolated markets
> and managed vaults on Ethereum, Base, and other EVM chains.

## LLM Documentation Endpoints
- [llms.txt](https://docs.morpho.org/llms.txt): This file — curated index of key pages
- [llms-full.txt](https://docs.morpho.org/llms-full.txt): All 119 pages in clean markdown
- [llms-all.txt](https://docs.morpho.org/llms-all.txt): All pages with code snippets inlined (recommended for full context)
- [llms-pages.json](https://docs.morpho.org/llms-pages.json): JSON mapping of URL path to {title, section, content}

## Get Started
- [Products](https://docs.morpho.org/get-started/products/): Overview of Earn and Borrow products built on Morpho
- [/get-started/use-cases/](https://docs.morpho.org/get-started/use-cases/): Real-world use cases on the Morpho stack
- [Addresses](https://docs.morpho.org/get-started/resources/addresses/): Deployed contract addresses across all supported chains
- [Morpho Contracts](https://docs.morpho.org/get-started/resources/contracts/): Technical reference for all Morpho smart contracts
- [Morpho](https://docs.morpho.org/get-started/resources/contracts/morpho/): Morpho core contract reference (market params, functions, events)
- [Audits - Security Reviews](https://docs.morpho.org/get-started/resources/audits/): Security audits and formal verification reports
- [Morpho Apps](https://docs.morpho.org/get-started/resources/app-ecosystem/): Morpho apps and ecosystem tools

## Learn
- [Variable Rate Market (Morpho Blue)](https://docs.morpho.org/learn/concepts/market/): How isolated lending markets work in Morpho V1
- [Morpho Vault V2](https://docs.morpho.org/learn/concepts/vault-v2/): Managed lending vaults built on top of Morpho Markets
- [/learn/concepts/vault/](https://docs.morpho.org/learn/concepts/vault/): Morpho Vault V1 architecture and mechanics
- [Curator](https://docs.morpho.org/learn/concepts/curator/): Role of curators in the Morpho ecosystem
- [Oracle](https://docs.morpho.org/learn/concepts/oracle/): How oracles provide price data for Morpho markets
- [Interest Rate Model](https://docs.morpho.org/learn/concepts/irm/): Interest Rate Model mechanics and the AdaptiveCurveIRM
- [Liquidation on Morpho](https://docs.morpho.org/learn/concepts/liquidation/): Liquidation mechanics and health factor calculations
- [Public Allocator](https://docs.morpho.org/learn/concepts/public-allocator/): Just-in-time liquidity reallocation across markets
- [Morpho Bundlers](https://docs.morpho.org/learn/concepts/bundlers/): Bundling multiple actions into a single transaction
- [Rewards on Morpho](https://docs.morpho.org/learn/concepts/rewards/): Reward distribution system for Morpho users
- [Flash Loans](https://docs.morpho.org/learn/concepts/flashloans/): Flash loan mechanics on Morpho

## Build
- [Morpho Vaults for Earn products](https://docs.morpho.org/build/earn/get-started/): Integrate Morpho Vaults for yield-generating deposits
- [Vaults & ERC4626 Mechanics](https://docs.morpho.org/build/earn/concepts/vault-mechanics/): ERC-4626 vault mechanics for Earn integrations
- [Depositing & Withdrawing from Vaults](https://docs.morpho.org/build/earn/tutorials/assets-flow/): Depositing and withdrawing from Morpho Vaults
- [Get Data](https://docs.morpho.org/build/earn/tutorials/get-data/): Fetching vault data via API, SDK, and onchain
- [Morpho Variable Rate Markets for Borrow products](https://docs.morpho.org/build/borrow/get-started/): Integrate Morpho Markets for collateralized borrowing
- [Market Mechanics](https://docs.morpho.org/build/borrow/concepts/market-mechanics/): Core market interactions and internal accounting
- [Collateral, LTV & Health](https://docs.morpho.org/build/borrow/concepts/ltv/): Collateral, LTV ratios, and health factor calculations
- [Liquidation](https://docs.morpho.org/build/borrow/concepts/liquidation/): Liquidation logic for borrow integrations
- [Supply Collateral, Borrow, Repay & Withdraw Collateral](https://docs.morpho.org/build/borrow/tutorials/assets-flow/): Supply collateral, borrow, repay, and withdraw
- [Get Data](https://docs.morpho.org/build/borrow/tutorials/get-data/): Fetching market data via API, SDK, and onchain
- [Guide: How to Monetize Your Borrow Product](https://docs.morpho.org/build/borrow/guides/monetize-borrow-product/): Monetize borrow products with transparent origination fees
- [Integrating Morpho Rewards](https://docs.morpho.org/build/rewards/get-started/): Integrate Morpho reward campaigns into your app
- [Create a Rewards Program](https://docs.morpho.org/build/rewards/tutorials/create-program/): Create a new rewards program via Merkl

## Curate
- [Morpho Curation](https://docs.morpho.org/curate/): Overview of Morpho Vault curation
- [Roles & Capabilities](https://docs.morpho.org/curate/concepts/roles/): Curator, allocator, and admin roles and permissions
- [Liquidity Curation](https://docs.morpho.org/curate/concepts/liquidity/): Liquidity curation strategies for vault capital
- [Security Considerations for Vault Curators](https://docs.morpho.org/curate/concepts/security-considerations/): Security best practices for vault curators
- [Create a Morpho Vault V2](https://docs.morpho.org/curate/tutorials-v2/vault-creation/): Deploy and configure a Morpho Vault V2
- [Configure Vault V2 Roles](https://docs.morpho.org/curate/tutorials-v2/roles/): Set up and manage Vault V2 roles
- [Act as a Sentinel in the Curator App](https://docs.morpho.org/curate/tutorials-v2/sentinel/): Use the Curator app to perform Sentinel risk-mitigation actions
- [Migrate from MorphoVaultV1Adapter to MorphoMarketV1AdapterV2](https://docs.morpho.org/curate/tutorials-v2/vault-v1-adapter-migration/): Migrate a Vault V2 from MorphoVaultV1Adapter to MorphoMarketV1AdapterV2
- [Create a Vault](https://docs.morpho.org/curate/tutorials-v1/vault-creation/): Deploy and configure a Morpho Vault V1
- [Curate Markets & Liquidity (Vaults V1)](https://docs.morpho.org/curate/tutorials-v1/manage-markets/): Manage markets and supply caps for Vault V1

## Tools
- [Introduction](https://docs.morpho.org/tools/): Developer hub for Morpho tools, SDKs, and APIs
- [Morpho API](https://docs.morpho.org/tools/offchain/api/get-started/): GraphQL API for markets, vaults, positions, and rewards
- [Morpho Markets](https://docs.morpho.org/tools/offchain/api/morpho/): API queries for Morpho Markets data
- [Morpho Vaults](https://docs.morpho.org/tools/offchain/api/morpho-vaults/): API queries for Morpho Vaults data
- [Morpho API Changelog](https://docs.morpho.org/tools/offchain/api/changelog/): Morpho API field deprecations, removals, and changes
- [Morpho SDKs](https://docs.morpho.org/tools/offchain/sdks/get-started/): TypeScript SDKs for Morpho protocol interactions
- [Public Allocator](https://docs.morpho.org/tools/onchain/public-allocator/): Public Allocator onchain tool reference
- [Using LLMs](https://docs.morpho.org/tools/ai/llms/): LLM-friendly documentation endpoints

## Optional

72 additional pages available in llms-full.txt and llms-all.txt.