export const autoplay = $state({ blocked: false });

export function resume() {
	autoplay.blocked = false;
	for (const v of document.querySelectorAll('video')) v.play().catch(() => {});
}
