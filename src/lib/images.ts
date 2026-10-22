const MAX = 4;

export type Image = { id: string; url: string };

function db(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const r = indexedDB.open('meet', 1);
		r.onupgradeneeded = () => r.result.createObjectStore('backgrounds', { keyPath: 'id' });
		r.onsuccess = () => resolve(r.result);
		r.onerror = () => reject(r.error);
	});
}

async function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
	const d = await db();
	return new Promise((resolve, reject) => {
		const t = d.transaction('backgrounds', mode);
		const r = f(t.objectStore('backgrounds'));
		t.oncomplete = () => {
			d.close();
			resolve(r ? r.result : undefined);
		};
		t.onerror = t.onabort = () => {
			d.close();
			reject(t.error ?? new DOMException('aborted', 'AbortError'));
		};
	});
}

// The single image older versions kept in localStorage. Runs before anything reads meet-bg-id.
export async function migrate() {
	const legacy = localStorage.getItem('meet-bg-image');
	if (!legacy) return;
	const id = await add(legacy);
	localStorage.removeItem('meet-bg-image');
	localStorage.setItem('meet-bg-id', id);
}

// Ids are creation times, so sorting them gives newest first.
export async function list(): Promise<Image[]> {
	const all = (await tx<Image[]>('readonly', s => s.getAll())) ?? [];
	return all.sort((a, b) => b.id.localeCompare(a.id));
}

export async function add(url: string): Promise<string> {
	const id = String(Date.now()).padStart(16, '0');
	await tx('readwrite', s => void s.put({ id, url }));
	const all = (await tx<Image[]>('readonly', s => s.getAll())) ?? [];
	const old = all.sort((a, b) => b.id.localeCompare(a.id)).slice(MAX);
	if (old.length) await tx('readwrite', s => old.forEach(o => s.delete(o.id)));
	return id;
}

export async function remove(id: string) {
	await tx('readwrite', s => void s.delete(id));
}

export async function get(id: string): Promise<string | null> {
	const r = await tx<Image>('readonly', s => s.get(id));
	return r?.url ?? null;
}
