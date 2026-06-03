import { writable } from 'svelte/store';

// productId → remaining count
export type InventoryMap = Record<string, number>;

function createInventoryStore() {
  const { subscribe, update, set } = writable<InventoryMap>({});

  return {
    subscribe,
    seed(inventory: InventoryMap) {
      set(inventory);
    },
    update(productId: string, remaining: number) {
      update((current) => ({ ...current, [productId]: remaining }));
    },
    reset() {
      set({});
    },
  };
}

export const inventoryStore = createInventoryStore();
