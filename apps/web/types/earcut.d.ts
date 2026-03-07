declare module 'earcut' {
  function earcut(
    data: ArrayLike<number>,
    holeIndices?: ArrayLike<number>,
    dim?: number,
  ): number[];
  export default earcut;
}
