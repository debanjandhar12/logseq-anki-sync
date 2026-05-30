import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";

dayjs.extend(advancedFormat);

export async function getUserPreferredDayjsFormat(): Promise<string> {
    const userConfig = await logseq.App.getUserConfigs();

    // Convert the date-fns-style format returned by logseq to dayjs format
    return userConfig.preferredDateFormat
        .replace(/yyyy/g, "YYYY")
        .replace(/yy/g, "YY")
        .replace(/dd/g, "DD")
        .replace(/do/g, "Do")
        .replace(/\bd\b/g, "D")
        .replace(/EEEE/g, "dddd")
        .replace(/EEE/g, "ddd");
}
