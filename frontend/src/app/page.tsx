"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Site açılışında normal kullanıcılar adminin eklediği profillere
    // istek gönderebilsin diye ana sayfa doğrudan Toplu Çalıştırıcı'ya gider.
    router.replace("/runner");
  }, [router]);

  return (
    <div className="py-24 text-center text-sm text-zinc-400 flex items-center justify-center space-x-2">
      <span>Toplu Çalıştırıcı'ya yönlendiriliyor...</span>
    </div>
  );
}