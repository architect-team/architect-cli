import leven from 'leven';

export const findPotentialMatch = (value: string, options: string[], max_distance = 15): string | undefined => {
  let potential_match;
  let shortest_distance = Infinity;
  const value_length = value.length;
  for (const option of [...options].sort()) {
    const option_length = option.length;
    // https://github.com/sindresorhus/leven/issues/14
    if (Math.abs(value_length - option_length) >= max_distance) {
      continue;
    }

    const distance = leven(value, option);
    if (distance < max_distance && distance <= shortest_distance) {
      potential_match = option;
      shortest_distance = distance;
    }
  }
  return potential_match;
};
