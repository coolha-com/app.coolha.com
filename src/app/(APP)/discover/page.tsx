"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  RiSearchLine,
  RiStarLine,
  RiHeartLine,
  RiPlugLine,
  RiScalesLine,
  RiArrowRightLine,
} from "react-icons/ri";



const items = [
  {
    id: "wallet",
    type: "skill",
    name: "Wallet Analyzer",
    description: "Analyze DeFi wallets.",
    installs: 12300,
    category: "Web3",
  },
  {
    id: "tweet",
    type: "skill",
    name: "Tweet Generator",
    description: "Generate social posts.",
    installs: 9200,
    category: "Marketing",
  },
  {
    id: "github",
    type: "mcp",
    name: "GitHub",
    description: "Connect repositories.",
    connected: true,
    category: "Developer",
  },
  {
    id: "supabase",
    type: "mcp",
    name: "Supabase",
    description: "Database connector.",
    connected: false,
    category: "Database",
  },
];

export default function DiscoverPage() {
  return (
    <section className="mx-auto max-w-7xl p-6">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/discover/${item.type}/${item.id}`}
          >
            <div className="rounded-2xl border border-auto bg-auto p-6 transition hover:border-primary">
              <div className="flex justify-between">
                <div className="text-3xl">
                  {item.type === "skill" ? "⚡" : <RiPlugLine size={28} />}
                </div>

                <RiHeartLine
                  size={18}
                  className="text-neutral-500"
                />
              </div>

              <h2 className="mt-5 text-xl font-semibold">
                {item.name}
              </h2>

              <p className="mt-2 text-sm text-neutral-400">
                {item.description}
              </p>

              <div className="mt-5">
                {item.type === "skill" ? (
                  <div className="flex items-center gap-2 text-sm text-neutral-400">
                    <RiStarLine
                      size={15}
                      fill="currentColor"
                    />
                    {item.installs?.toLocaleString()} installs
                  </div>
                ) : (
                  <div
                    className={`text-sm ${
                      item.connected
                        ? "text-green-400"
                        : "text-neutral-400"
                    }`}
                  >
                    {item.connected
                      ? "● Connected"
                      : "Not Connected"}
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                  {item.category}
                </span>

                <button className="rounded-lg bg-primary px-4 py-2 text-sm text-black">
                  {item.type === "skill"
                    ? "Install"
                    : "Connect"}
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}