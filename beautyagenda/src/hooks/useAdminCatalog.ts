import { useAsync } from './useAsync.ts';
import { listProfessionals } from '../services/professionals.ts';
import { listServices } from '../services/catalog.ts';

/** Profissionais e serviços para formulários do painel. */
export function useAdminCatalog(enabled = true) {
  return useAsync(async () => {
    if (!enabled) return null;
    const [professionals, services] = await Promise.all([listProfessionals(), listServices()]);
    return { professionals, services };
  }, [enabled]);
}
