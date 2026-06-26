import { idSchema, watchlistAddSchema } from '@vms/shared';
import { addWatchlistEntry, listWatchlist, removeWatchlistEntry } from '../../services/security.ts';
import { actorFrom, authorized } from '../permission.ts';
import { router } from '../trpc.ts';

export const watchlistRouter = router({
  list: authorized({ watchlist: ['read'] }).query(() => listWatchlist()),

  add: authorized({ watchlist: ['manage'] })
    .input(watchlistAddSchema)
    .mutation(({ input, ctx }) => addWatchlistEntry(input, actorFrom(ctx.user))),

  remove: authorized({ watchlist: ['manage'] })
    .input(idSchema)
    .mutation(({ input, ctx }) => removeWatchlistEntry(input.id, actorFrom(ctx.user))),
});
