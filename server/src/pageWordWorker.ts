import './config';
import {processNextPageWordJob} from './services/pageLineService';

// A claimed private job is recovered on startup if systemd stops this process.
// Do not wait for a long model inference during a release switch.
process.once('SIGTERM',()=>process.exit(0));
process.once('SIGINT',()=>process.exit(0));
async function run(){
 while(true)if(!await processNextPageWordJob())await new Promise(resolve=>setTimeout(resolve,2000));
}
run().catch(error=>{console.error('BonBook reader word worker stopped:',error instanceof Error?error.name:'error');process.exitCode=1;});
