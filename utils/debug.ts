

// deno-lint-ignore no-explicit-any
export function debug(...args: any| undefined) {
    if (args !== undefined) {
        console.log(JSON.stringify(args, null, 2)); 
    }
  return;
}