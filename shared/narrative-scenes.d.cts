export function schedule<T extends {start:number;end:number}>(scenes:T[],cues:{time:number;offset:number}[]):(T&{time:number|null})[];
export function activeScene<T extends {start:number;end:number}>(scenes:T[],cues:{time:number;offset:number}[],time:number):(T&{time:number|null})|null;
