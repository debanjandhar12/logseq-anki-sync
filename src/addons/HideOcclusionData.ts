import {Addon} from "./Addon";

export class HideOcclusionData extends Addon {
    static _instance: HideOcclusionData;

    public getName(): string {
        return "Hide Occlusion Data";
    }

    public init(): void {
        if (this.isEnabled()) {
            logseq.provideStyle({
                style: `div:has(a[data-ref="occlusion"]) + span + .page-property-value > div {
                display: none;
            }
            div:has(a[data-ref="occlusion"]) + span + .page-property-value:before {
                display: inline;
                content: '<hidden occlusion data>';
                font-style: italic;
            }`,
                key: "hide-occlusion-data",
            });
        } else {
            logseq.provideStyle({style: ``, key: "hide-occlusion-data"});
        }
    }
    public static getInstance(): Addon {
        if (!HideOcclusionData._instance) HideOcclusionData._instance = new HideOcclusionData();
        return HideOcclusionData._instance;
    }
}
