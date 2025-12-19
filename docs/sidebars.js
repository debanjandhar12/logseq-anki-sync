const sidebars = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Card Types',
      items: [
        'card-types/multiline',
        'card-types/cloze',
        'card-types/swift-arrow',
        'card-types/image-occlusion',
      ],
    },
    {
      type: 'category',
      label: 'Usage Guides',
      items: [
        'usage/extra-details-hints',
      ],
    },
  ],
};

module.exports = sidebars;
