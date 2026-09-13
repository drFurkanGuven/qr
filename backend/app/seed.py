"""Initial seed script to populate sample request templates for testing."""

import asyncio
from app.core.database import AsyncSessionLocal, init_db
from app.models.template import RequestTemplate
from sqlalchemy import select


SAMPLE_TEMPLATES = [
    {
        "name": "Bilet / QR Doğrulama Servisi",
        "description": "Taranan QR kodunu doğrulama servisine iletir ve yanıtı kontrol eder.",
        "method": "POST",
        "url": "https://httpbin.org/post",
        "headers": {
            "Content-Type": "application/json",
            "X-Client-Version": "1.0.0"
        },
        "body_type": "json",
        "body": """{
  "ticket_qr": "{{qr_data}}",
  "scanned_at": "{{iso_timestamp}}",
  "scan_id": "{{uuid}}"
}""",
        "query_params": {"channel": "mobile_scanner"},
        "timeout_seconds": 10.0,
        "is_active": True,
        "group_name": "bilet_kontrol",
        "order_index": 1,
    },
    {
        "name": "Envanter Barkod Sorgulama",
        "description": "Barkod numarasını ürün arama servisine query parametresiyle iletir.",
        "method": "GET",
        "url": "https://httpbin.org/get?barcode={{qr_data}}&device=kamera_1",
        "headers": {
            "Accept": "application/json"
        },
        "body_type": "json",
        "body": "",
        "query_params": {},
        "timeout_seconds": 8.0,
        "is_active": True,
        "group_name": "envanter",
        "order_index": 2,
    },
    {
        "name": "Webhook Tetikleme ve Loglama",
        "description": "Dış sisteme taranan barkod ve rastgele oturum numarası ile bildirim atar.",
        "method": "POST",
        "url": "https://httpbin.org/anything",
        "headers": {
            "Content-Type": "application/json",
            "Authorization": "Bearer sample_secret_token"
        },
        "body_type": "json",
        "body": """{
  "event": "QR_SCANNED",
  "payload": {
    "raw_input": "{{qr_data}}",
    "trace_id": "{{uuid}}",
    "batch_seq": "{{random_int:1000:9999}}"
  }
}""",
        "query_params": {},
        "timeout_seconds": 12.0,
        "is_active": True,
        "group_name": "webhook",
        "order_index": 3,
    },
]


async def seed():
    await init_db()
    async with AsyncSessionLocal() as session:
        # Check if templates already exist
        res = await session.execute(select(RequestTemplate))
        existing = res.scalars().all()
        if existing:
            print(f"Veritabanında halihazırda {len(existing)} şablon bulunuyor. Seed atlandı.")
            return

        for tpl_data in SAMPLE_TEMPLATES:
            tpl = RequestTemplate(**tpl_data)
            session.add(tpl)
        await session.commit()
        print(f"✅ {len(SAMPLE_TEMPLATES)} adet örnek şablon başarıyla eklendi.")


if __name__ == "__main__":
    asyncio.run(seed())
