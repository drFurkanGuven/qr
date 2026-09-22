import asyncio
import json
from typing import Dict, Set, Any
from collections import defaultdict


class SSEManager:
    """Manages Server-Sent Events subscriber queues for course sessions."""

    def __init__(self):
        # session_id -> Set[asyncio.Queue]
        self._subscribers: Dict[str, Set[asyncio.Queue]] = defaultdict(set)

    def subscribe(self, session_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers[session_id].add(queue)
        return queue

    def unsubscribe(self, session_id: str, queue: asyncio.Queue):
        if session_id in self._subscribers:
            self._subscribers[session_id].discard(queue)
            if not self._subscribers[session_id]:
                del self._subscribers[session_id]

    async def broadcast_event(self, session_id: str, event_type: str, data: Dict[str, Any]):
        if session_id not in self._subscribers:
            return

        payload = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        dead_queues = []
        for q in self._subscribers[session_id]:
            try:
                q.put_nowait(payload)
            except (asyncio.QueueFull, Exception):
                dead_queues.append(q)

        for dq in dead_queues:
            self._subscribers[session_id].discard(dq)


sse_manager = SSEManager()
