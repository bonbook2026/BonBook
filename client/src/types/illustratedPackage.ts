export interface IllustratedPackage {
 id:string;bookId:number;filename:string;size:number;status:string;chunkBytes:number;chunkCount:number;received?:number[];appliedStart?:number;
 book?:{title:string;author:string;description:string;language:string};totalPages?:number;images?:number;audio?:number;firstPage?:number;lastPage?:number;
 pages?:{number:number;heading:string;excerpt:string;image:boolean;audio:boolean;timed:boolean;scenes?:number}[];
}
