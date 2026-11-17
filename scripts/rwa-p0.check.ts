/**
 * RWA P0 纯函数检查。不连网，不读密钥。
 *   node --experimental-strip-types scripts/rwa-p0.check.ts
 */
import assert from "node:assert/strict"
import {
  CHAIN_REGISTRY,
  chainDisplayStatus,
  connectedChains,
  isConnectedChain,
  reservedChains,
} from "../src/lib/chains/registry.ts"
import { balanceOfData, decodeAbiString, formatShare, formatUnits } from "../src/lib/rwa/abi.ts"

const connected = connectedChains().map((entry) => entry.key)
assert.deepEqual(connected, ["ethereum", "bnb", "avalanche", "arbitrum"])
assert.deepEqual(reservedChains().map((entry) => entry.key), ["zksync", "base", "polygon"])
assert.equal(isConnectedChain("base"), false)
assert.equal(isConnectedChain("ethereum"), true)
assert.ok(connectedChains().every((entry) => entry.verification === "unverified"))
assert.equal(chainDisplayStatus(CHAIN_REGISTRY[0]), "未核验")
assert.equal(chainDisplayStatus(CHAIN_REGISTRY.find((entry) => entry.key === "base")), "未接入")
assert.ok(CHAIN_REGISTRY.every((entry) => chainDisplayStatus(entry) !== "已接通"))
assert.ok(CHAIN_REGISTRY.every((entry, index) => entry.priority === index + 1))
assert.ok(reservedChains().every((entry) => entry.alchemySubdomain === null))

assert.equal(formatShare(1n, 4n), "25.0000%")
assert.equal(formatShare(1n, 0n), null)
assert.equal(formatUnits(1_500_000n, 6), "1.5")

const dynamic = `0x${"0".repeat(62)}20${"0".repeat(62)}05${Buffer.from("HELLO").toString("hex").padEnd(64, "0")}`
assert.equal(decodeAbiString(dynamic), "HELLO")
const word = `0x${Buffer.from("USDC").toString("hex").padEnd(64, "0")}`
assert.equal(decodeAbiString(word), "USDC")

const data = balanceOfData("0x0000000000000000000000000000000000000001")
assert.ok(data.startsWith("0x70a08231"))
assert.ok(data.endsWith("1"))

console.log("RWA_P0: ALL_PASS")
