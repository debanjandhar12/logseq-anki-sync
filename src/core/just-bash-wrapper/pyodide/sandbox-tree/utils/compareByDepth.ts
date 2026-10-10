const depth = (path: string): number => path.split("/").length;

export const compareByDepthAscending = (left: string, right: string): number =>
    depth(left) - depth(right);
export const compareByDepthDescending = (left: string, right: string): number =>
    depth(right) - depth(left);
