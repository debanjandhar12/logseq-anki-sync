# Creating a simple multiline card
The **simplest way to make a multiline card** is to use the `#card` tag.

**For Example,**
```md
SQL commands can be divided into: #card
```
- ```md
  Data Definition Language
  ```
- ```md
  Data Manipulation Language
  ```
- ```md
  Data Control Language
  ```
This will create a note with following cards in Anki:
| Front  | Back  |
|---|---|
| ![image](https://user-images.githubusercontent.com/49021233/182570224-934ca5db-0e4b-4afc-b024-eab22b04dd3f.png) | ![image](https://user-images.githubusercontent.com/49021233/182570284-4d1ecef2-0684-42f6-8678-2e19207e8584.png) |

# Creating incremental multiline card
Now, a characteristic of a good SRS card is that it should be atomic. The above card is clearly not atomic as we are recalling three names in one card. The plugin provides the `#incremental` tag so that each children bullet can be a separate card.
**For Example,**
```md
SQL commands can be divided into: #card #incremental
```
- ```md
  Data Definition Language
  ```
- ```md
  Data Manipulation Language
  ```
- ```md
  Data Control Language
  ```
This will create a note with following cards in anki:
| Front  | Back  |
|---|---|
|  ![image](https://user-images.githubusercontent.com/49021233/182570538-bd0dc5f1-2c20-428c-abc5-fbf27f8accae.png) | ![image](https://user-images.githubusercontent.com/49021233/182570569-5c5f25b5-77ba-4caf-96bf-9a731cc85110.png)  |
|  ![image](https://user-images.githubusercontent.com/49021233/182570591-4b11c908-0319-4ecf-b6ac-20aa6daede65.png) | ![image](https://user-images.githubusercontent.com/49021233/182570623-b16f6ad2-3ab2-40a0-981a-89fb3fcf655b.png)  |
|  $$\vdots$$  | $$\vdots$$  |

# Specifying direction of multiline card
It is also possible to **specify the direction of the card**. This is done using the tags: `#forward`, `#reversed`, `#bidirectional`

**For Example,**
```md
SQL commands can be divided into: #card #reversed
```
- ```md
  Data Definition Language
  ```
- ```md
  Data Manipulation Language
  ```
- ```md
  Data Control Language
  ```
This will create a note with following cards in anki:
| Front  | Back  |
|---|---|
|  ![image](https://user-images.githubusercontent.com/49021233/182570958-e5904212-ddc2-4923-b69f-3860489a2ac0.png) | ![image](https://user-images.githubusercontent.com/49021233/182570983-6cd505cd-8e9a-4918-9818-e9374096a71c.png)  |


# Additonal Points
- You can use the `#flashcard` tag instead of `#card` to create a card incase you don't want logseq to treat it as a card.
- You can use the direction property `direction:: ->`, `direction:: <-`, `direction:: <->` to specify the direction of the card as well.
- You can use the `#depth-n` tag to limit the children rendering depth to n. For example, `#depth-1` will render only the first level of children.
- You can use the `#card-group` tag to turn all the children of it's block to cards. For example, [click here](https://user-images.githubusercontent.com/49021233/208642258-3fea7b7f-38f6-4a36-ac68-e623e5892f23.gif).

[<div align="right">Return to Documentation Index</div>](https://github.com/debanjandhar12/logseq-anki-sync/#-documentation)