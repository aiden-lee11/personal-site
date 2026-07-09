"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Share links minted before the /compiler split pointed at /compiler#s=…
 * The visualizer that reads that hash now lives at /compiler/playground,
 * so forward the hash along.
 */
export default function ShareLinkRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (window.location.hash.startsWith("#s=")) {
      router.replace(`/compiler/playground${window.location.hash}`);
    }
  }, [router]);
  return null;
}
