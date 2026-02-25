import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    const list = searchParams.get('list');

    if (list) {
        try {
            await ensureDataDir();
            const files = await fs.readdir(DATA_DIR);
            const saves = await Promise.all(
                files
                    .filter(f => f.endsWith('.json'))
                    .map(async f => {
                        const stat = await fs.stat(path.join(DATA_DIR, f));
                        return {
                            id: f.replace('.json', ''),
                            updatedAt: stat.mtime
                        };
                    })
            );
            return NextResponse.json(saves);
        } catch {
            return NextResponse.json([]);
        }
    }

    if (!key) {
        return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(DATA_DIR, `${cleanKey}.json`);

    try {
        await ensureDataDir();
        const content = await fs.readFile(filePath, 'utf-8');
        return NextResponse.json(JSON.parse(content));
    } catch (error) {
        // If file doesn't exist, return null
        return NextResponse.json(null);
    }
}

export async function POST(req: Request) {
    let body;
    try {
        body = await req.json();
    } catch (error) {
        console.error('[STORAGE API] Invalid JSON:', error);
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { key, value } = body || {};

    if (!key || value === undefined) {
        return NextResponse.json({ error: 'Key and value are required' }, { status: 400 });
    }

    const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(DATA_DIR, `${cleanKey}.json`);

    try {
        await ensureDataDir();
        await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to save data:', error);
        return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) {
        return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(DATA_DIR, `${cleanKey}.json`);

    try {
        await fs.unlink(filePath);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete data' }, { status: 500 });
    }
}
