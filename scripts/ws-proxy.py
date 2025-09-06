#!/usr/bin/env python3
"""
Simple WebSocket proxy for local testing.
Accepts connections on localhost:8765 and broadcasts any received message to all other clients.
Run: python scripts/ws-proxy.py
Requires: pip install websockets
"""
import asyncio
import websockets

CLIENTS = set()

async def handler(ws, path):
    CLIENTS.add(ws)
    addr = ws.remote_address
    print(f"Client connected: {addr}")
    try:
        async for msg in ws:
            print(f"Received from {addr}: {msg[:200]}")
            # Broadcast to other clients
            for c in list(CLIENTS):
                if c is ws:
                    continue
                try:
                    await c.send(msg)
                except Exception as e:
                    print("Failed to send to client", e)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        CLIENTS.remove(ws)
        print(f"Client disconnected: {addr}")

async def main():
    print("Starting WS proxy on ws://localhost:8765 ...")
    server = await websockets.serve(handler, 'localhost', 8765)
    await server.wait_closed()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print('\nShutting down')
