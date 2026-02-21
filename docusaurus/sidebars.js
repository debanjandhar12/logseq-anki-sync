const sidebars = {
    tutorialSidebar: [
        "intro",
        "installation",
        {
            type: "category",
            label: "Card Types",
            items: [
                "card-types/multiline",
                "card-types/swift-arrow",
                "card-types/cloze",
                "card-types/image-occlusion",
                "card-types/highlight-mask",
            ],
        },
        {
            type: "category",
            label: "Usage Guides",
            items: [
                "usage/deck-tags",
                "usage/extra-details-hints",
                "usage/suspend-and-disable-sync",
                "usage/type-in-answer-tag",
                "usage/hiding-parent-blocks",
                "usage/hide-all-test-one",
            ],
        },
        {
            type: "category",
            label: "Advanced",
            items: ["advanced/sync-behavior", "advanced/custom-css"],
        },
    ],
};

module.exports = sidebars;
