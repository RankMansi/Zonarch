/** Band room context — delegates to web orchestrator in dev */

const WEB_URL = process.env.WEB_ORCHESTRATOR_URL || 'http://localhost:3000';

export const bandRoom = {
  context: {
    async get(roomId: string, key: string) {
      const res = await fetch(`${WEB_URL}/api/band/${roomId}`);
      const data = await res.json();
      return data[key];
    },
    async set(roomId: string, key: string, value: unknown) {
      await fetch(`${WEB_URL}/api/band/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
    },
  },
};
