# Specifying Extra Details
The plugin allows you to specify extra details for all the note types. It can be done by using `extra` Property or `extra` ORG Block.
**For Example,**
```md
extra:: Mnemonics: **Na**tive **M**a**g**pies **Al**ways **Si**t **P**eacefully **S**earching **Cl**ear **Ar**eas
Periodic Table - Period 3 :->
Na Mg Al Si P S Cl Ar
```
or
```md
Periodic Table - Period 3 :->
Na Mg Al Si P S Cl Ar
#+BEGIN_EXTRA
Mnemonics: **Na**tive **M**a**g**pies **Al**ways **Si**t **P**eacefully **S**earching **Cl**ear **Ar**eas
#+END_EXTRA
```
Both of the above will create a note with following card in anki:
| Front  | Back  |
|---|---|
|  ![image](https://user-images.githubusercontent.com/49021233/182575176-e3b5f8c8-aef8-4cca-aacb-58979a31ec69.png) | ![image](https://user-images.githubusercontent.com/49021233/182575198-ca2b7720-c6c2-4d61-8e87-f202caddcf85.png)  |

# Specifying Hints
Hints are not officially supported by the plugin yet. However, you can use this trick with Anki's cloze marco syntax and Logseq's cloze syntax to specify hint:
**For Example,**
```md
{{c1 Tokyo::what city?}} is the capital of Japan.
```
This will create a note with following card in anki:
| Front  | Back  |
|---|---|
|  ![image](https://user-images.githubusercontent.com/49021233/182575326-5a894be8-a28a-4add-b206-333d41537381.png) | ![image](https://user-images.githubusercontent.com/49021233/182575356-20dec0b8-04a4-45df-bcb7-8351b99effb2.png)  |
