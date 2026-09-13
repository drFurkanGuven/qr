"""Initial seed script to populate sample request templates for testing."""

import asyncio
from app.core.database import AsyncSessionLocal, init_db
from app.models.template import RequestTemplate
from sqlalchemy import select


SAMPLE_TEMPLATES = [
    {
        "name": "Yoklama Doğrulama (Cihaz 1)",
        "description": "Lab yoklama sistemi POST /api/attendance/verify isteği. QR okununca aynı qr_token iletilir.",
        "method": "POST",
        "url": "https://httpbin.org/post",
        "headers": {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": "Bearer sample_token_here",
            "X-Device-Uuid": "e3b0c442-98fc-1c14-9afb-4c8996fb9242",
            "User-Agent": "denemeapp/2 CFNetwork/3860.600.12 Darwin/25.5.0",
            "Accept-Language": "tr-TR,tr;q=0.9",
        },
        "body_type": "json",
        "body": '{\n  "qr_token": "{{qr_token}}"\n}',
        "query_params": {},
        "timeout_seconds": 10.0,
        "is_active": True,
        "group_name": "lab_yoklama",
        "order_index": 1,
    },
    {
        "name": "Yoklama Doğrulama (Cihaz 2)",
        "description": "Lab yoklama sistemi 2. cihaz profili. Farklı Device UUID ve Bearer Token.",
        "method": "POST",
        "url": "https://httpbin.org/post",
        "headers": {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": "Bearer sample_token_device_2",
            "X-Device-Uuid": "d7a8fbb1-4c12-4e89-8cb3-128937402831",
            "User-Agent": "denemeapp/2 CFNetwork/3860.600.12 Darwin/25.5.0",
            "Accept-Language": "tr-TR,tr;q=0.9",
        },
        "body_type": "json",
        "body": '{\n  "qr_token": "{{qr_token}}"\n}',
        "query_params": {},
        "timeout_seconds": 10.0,
        "is_active": True,
        "group_name": "lab_yoklama",
        "order_index": 2,
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
        print(f"✅ {len(SAMPLE_TEMPLATES)} adet örnek yoklama şablonu başarıyla eklendi.")


if __name__ == "__main__":
    asyncio.run(seed())
