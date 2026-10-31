interface SpreadPage{bookId:number;number:number}
export interface ReadingSpread<T>{right:T;left:T}

// The active recording may change sheets without changing the open pair.
export function advanceReadingSpread<T extends SpreadPage>(held:ReadingSpread<T>|null,current:T|null,target:T|null,nextNumber:number|undefined,spread:boolean):ReadingSpread<T>|null{
 if(!spread||!current||!target||current.bookId!==target.bookId)return null;
 if(held)return held.right.bookId===target.bookId&&(held.right.number===target.number||held.left.number===target.number)?held:null;
 return target.number===nextNumber?{right:current,left:target}:null;
}
