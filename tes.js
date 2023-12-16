//@ts-ignore

// @ts-ignore
let data = [
    {
        "name": "SMB",
        "rootDir": "",
        "child": [
            {
                "name": "SMB2",
                "child": [
                    {
                        "name": "SMB3",
                        "rootDir": "d:\\Project\\SMB\\gateway global"
                    }
                ]
            }
        ]
    },
    {
        "name": "SMB5",
        "rootDir": "",
        "child": [
            {
                "name": "SMB2",
                "child": [
                    {
                        "name": "SMB5 Last",
                        "rootDir": "d:\\Project\\SMB\\gateway global"
                    }
                ]
            }
        ]
    },
    {
        "name": "awal Last",
        "rootDir": "d:\\Project\\SMB\\gateway global"
    }
]
const {v4:uuid4} = require("uuid");

const nestedTree = arr => {
    const iterateData = (arr1, parentId) => {
        return arr1.map(x => {
            if (!x.id) {
                x.id = uuid4();
                if(parentId) x.parentId = parentId;
            }

            if (x.child) x.child = iterateData(x.child, x.id);

            return x;
        })
    }

    return iterateData(arr)
}

const new_data = nestedTree(data);
// console.log(new_data[0].child[0]);
console.log(JSON.stringify(new_data, null, 2));
// console.log(new_data);

