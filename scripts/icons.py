"""Generate the small code-native shield icon without image dependencies."""
from pathlib import Path
import math
import struct
import zlib

OUT = Path(__file__).resolve().parents[1] / 'extension' / 'icons'
OUT.mkdir(parents=True, exist_ok=True)
SHIELD = [(16, 5), (26, 9), (25, 19), (22, 24), (16, 28), (10, 24), (7, 19), (6, 9)]


def inside(x, y):
    result = False
    for (ax, ay), (bx, by) in zip(SHIELD, SHIELD[1:] + SHIELD[:1]):
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            result = not result
    return result


def distance(x, y, ax, ay, bx, by):
    t = max(0, min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)))
    return math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay))


def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))


for size in (16, 32, 48, 128):
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            channels = [0, 0, 0, 0]
            for sy in range(4):
                for sx in range(4):
                    px, py = (x + (sx + .5) / 4) * 32 / size, (y + (sy + .5) / 4) * 32 / size
                    if inside(px, py):
                        check = min(distance(px, py, 11, 16, 15, 20), distance(px, py, 15, 20, 22, 12)) < 1.1
                        color = (248, 251, 246, 255) if check else (35, 109, 85, 255)
                    else:
                        color = (0, 0, 0, 0)
                    for index, value in enumerate(color):
                        channels[index] += value
            rows.extend(round(value / 16) for value in channels)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')
    (OUT / f'{size}.png').write_bytes(data)
print('Iconos generados en extension/icons/.')
