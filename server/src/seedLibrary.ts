import fs from 'fs';
import path from 'path';
import prisma from './lib/prisma';
import { normalizePersian } from './services/searchService';

async function main(){
  if(!await prisma.libraryBook.count()){
  const samples=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../shared/starter-library.json'),'utf8'));
  await prisma.$transaction(samples.map((sample:any)=>prisma.libraryBook.create({data:{
    title:sample.title,author:sample.author,category:sample.category,description:sample.description,coverTone:sample.coverTone,status:'PUBLISHED',isSample:true,
    pages:{create:sample.pages.map((page:any,index:number)=>({...page,number:index+1,searchText:normalizePersian(page.heading+' '+page.keywords+' '+page.content)}))},
  }})));
  console.log('Original BonBook sample library created.');
  }
  const books=await prisma.libraryBook.findMany({where:{OR:[{categoryId:null},{catalogText:''}]}});
  for(const book of books){
    const key='0:'+normalizePersian(book.category);
    const category=book.categoryId?null:await prisma.bookCategory.upsert({where:{key},create:{name:book.category,key},update:{}});
    if(category||!book.catalogText)await prisma.libraryBook.update({where:{id:book.id},data:{...(category?{categoryId:category.id}:{}),...(!book.catalogText?{catalogText:normalizePersian(book.title+' '+book.author+' '+book.category+' '+book.tags)}:{})}});
  }
}
main().finally(()=>prisma.$disconnect());
