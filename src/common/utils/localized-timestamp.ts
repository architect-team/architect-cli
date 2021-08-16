const locale = Intl.DateTimeFormat().resolvedOptions().locale;
// Following line is ts-ignored because typing for DateTimeFormatOptions was broken.
// This has since been resolved in es2020, but there were other issues with mocha
// after updating the target from es2017. Easiest to just ignore the check for now.
const format_options: Intl.DateTimeFormatOptions = { // @ts-ignore
  dateStyle: 'short',
  timeStyle: 'long'
};

const localizedTimestamp = (timestamp: string): string => {
    const date = Date.parse(timestamp);
    return new Intl.DateTimeFormat(locale, format_options).format(date);
}

export default localizedTimestamp;
