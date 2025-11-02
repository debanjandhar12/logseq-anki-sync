Unlike multiline cards, there are multiple ways to create a cloze card.

# Creating a cloze card using Anki's Cloze Macro Syntax
The simplest and recomended way to create a cloze card is to use the Anki Macro Syntax. It allows extensive control over the card creation.
**For Example,**
```md
{{c2 Japan}} is the capital of {{c1 Japan}} (aka {{c1 Nipon}}).
```
Here, the digit after `c` specify the card number where the cloze is (only 1-9 is supported). This will create a note with following cards in anki:
| Front  | Back  |
|---|---|
|  ![image](https://user-images.githubusercontent.com/49021233/182571281-579c0c00-126c-4737-ac4f-d5671a16f59a.png) | ![image](https://user-images.githubusercontent.com/49021233/182571309-752030ad-4b7f-4520-b9f9-68dd6256bcd8.png)  |
|  ![image](https://user-images.githubusercontent.com/49021233/182571483-b63d019a-0395-4578-968d-3b8376ef3d64.png) | ![image](https://user-images.githubusercontent.com/49021233/182571510-05b39c26-d3b1-4153-99f6-1efe28cbdc28.png) |

# Creating a cloze card using Logseq's Cloze Macro Syntax
Since the plugin is backward compatable with logseq, it is also possible to use Logseq's Cloze Macro Syntax.
**For Example,**
```md
Tokyo is the capital of {{cloze Japan}} (aka {{cloze Nipon}}).
```
Notice how we cant cloze the word Nipon and Japan together as it is not possible to specify card number in this syntax.
This will create a note with following cards in anki:
| Front  | Back  |
|---|---|
|  ![image](https://user-images.githubusercontent.com/49021233/182571968-4a4a8704-ebe1-4cc4-acf4-1277882a0be2.png) | ![image](https://user-images.githubusercontent.com/49021233/182571983-5243c0b3-1a69-4455-86e0-7eefc11224e9.png)  
|  ![image](https://user-images.githubusercontent.com/49021233/182572014-78202e28-0c38-4555-aed7-d60d7fde7d34.png)| ![image](https://user-images.githubusercontent.com/49021233/182572038-a3eceaa5-5fdd-4935-98c3-d410158f2d8c.png)  |


# Creating a cloze card using ORG CLOZE Block Syntax
In all of the above examples, we can only cloze words that are in single line. This syntax allows you to cloze multiple lines.
**For Example,**
```md
The Pythagorean theorem is
#+BEGIN_CLOZE
$$c=\sqrt{ a^{2}+b^{2} }$$
#+END_CLOZE
```
This will create a note with following cards in anki:
| Front  | Back  |
|---|---|
|  ![image](https://user-images.githubusercontent.com/49021233/182572363-2acd54f0-70eb-4d8f-89a6-9b59e5548452.png) | ![image](https://user-images.githubusercontent.com/49021233/182572381-0fdd1c65-175d-4a07-b728-ccea7884394e.png)  |

# Creating a cloze card using replaceCloze Syntax
In all of the above examples, we cannot cloze inside math or code. This syntax allows you to cloze inside math or code.
**For Example,**
```md
replacecloze:: " 'a^{2}+b^{2}', /(c\^2|c )/gi "
The Pythagorean theorem is
$$c =\sqrt{ a^{2}+b^{2} }$$
$$c^2= a^{2}+b^{2}$$
```
The `replaceCloze` takes a string which contains a list of regex or strings that are to be clozed.
This will create a note with following cards in anki:
| Front  | Back  |
|---|---|
|  ![image](https://user-images.githubusercontent.com/49021233/182572636-2e050021-7f71-46ba-97d4-c24aa2ea8371.png) | ![image](https://user-images.githubusercontent.com/49021233/182572656-1506687f-06af-41fc-886f-7c5ca69cc991.png)  |
|  ![image](https://user-images.githubusercontent.com/49021233/182572684-429cd32b-96a5-431a-855a-f5921e843658.png) | ![image](https://user-images.githubusercontent.com/49021233/182572705-a38af007-20b9-45d9-8954-4465d9fc022a.png)  |
