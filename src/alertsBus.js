// src/alertsBus.js
export const alertsBus = {
  listeners: new Set(),
  fire() { for (const fn of this.listeners) fn(); },
  subscribe(fn){ this.listeners.add(fn); return ()=>this.listeners.delete(fn); }
};
