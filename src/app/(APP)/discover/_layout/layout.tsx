"use client";

import { useState } from "react";
import { RiSearchLine, RiScalesLine, } from "react-icons/ri";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function DiscoverLayoutUI() {
  const params = useParams();

  return (
    <main className="min-h bg-auto">
      {/* Hero */}
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-7xl p-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
              <RiScalesLine size={16} />
              AI Marketplace
            </div>

            <h1 className="mt-4 text-5xl font-bold">
              Discover Skills & MCP
            </h1>

            <p className="mt-5 text-lg text-neutral-400">
              Browse AI Skills and connect powerful MCP services.
            </p>

            {/* Search */}
            <div className="mt-8 flex items-center rounded-xl border border-neutral-500 bg-auto px-4">
              <RiSearchLine
                className="text-neutral-500"
                size={18}
              />
              <input
                placeholder="Search..."
                className="h-14 flex-1 bg-transparent px-3 outline-none"
              />
            </div>


          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl gap-3 px-6 py-5">
          {[
            ["/", "All"],
            ["skills", "Skills"],
            ["mcp", "MCP"],
          ].map(([value, label]) => (
            <Link
              href={`/discover/${value}`}
              key={value}

              className={`rounded-lg px-5 py-2 transition ${params.type === value
                ? "bg-auto text-auto border border-auto"
                : "bg-auto text-auto border border-auto hover:bg-accent-800 hover:border-primary"
                }`}
            >
              {label}
            </Link>
          ))}


        </div>
      </section>


    </main>
  );
}