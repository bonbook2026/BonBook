import { PrismaClient } from '@prisma/client';

// SQLite has one writer. Queue this process's work before opening competing
// transactions, so blocked SQLite BEGIN calls cannot starve the query engine.
const database=process.env.DATABASE_URL;
let sqliteUrl:string|undefined;
if(database?.startsWith('file:')){
  const separator=database.indexOf('?'),location=separator<0?database:database.slice(0,separator),parameters=new URLSearchParams(separator<0?'':database.slice(separator+1));
  parameters.set('connection_limit','1');sqliteUrl=location+'?'+parameters.toString();
}
const prisma = new PrismaClient(sqliteUrl?{datasources:{db:{url:sqliteUrl}}}:undefined);

export default prisma;
