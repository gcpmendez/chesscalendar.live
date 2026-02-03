import { backgroundSyncTournaments } from '../lib/scraper';

async function triggerSync() {
    console.log('Triggering background sync for Santa Cruz de Tenerife...');
    await backgroundSyncTournaments('ESP', 'Santa Cruz de Tenerife');
    console.log('Sync complete!');
}

triggerSync();
