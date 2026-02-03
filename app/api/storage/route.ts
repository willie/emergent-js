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
    const body = await req.json();
    const { key, value } = body;

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
