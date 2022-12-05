import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BytesLike, ethers } from "ethers";
import * as readline from "readline";
import * as dotenv from "dotenv";
import { Lottery, LotteryToken, LotteryToken__factory, Lottery__factory } from "../typechain-types";
dotenv.config();

let contract: Lottery;
let token: LotteryToken;
let provider: ethers.providers.Provider;
let wallet: ethers.Wallet;

const BET_PRICE = 1;
const BET_FEE = 0.2;
const TOKEN_RATIO = 100;

async function main() {
    await initContracts();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    mainMenu(rl);
}

async function initContracts() {

    provider = ethers.getDefaultProvider("goerli", {
        etherscan: process.env.ETHERSCAN_API_KEY,
        infura: process.env.INFURA_API_KEY,
        alchemy: process.env.ALCHEMY_API_KEY
    });

    const seed = process.env.MNEMONIC;
    const pKey = process.env.PRIVATE_KEY_1 as string; // deployer

    // const wallet = ethers.Wallet.fromMnemonic(seed ?? "");
    wallet = new ethers.Wallet(pKey);

    const signer = wallet.connect(provider);

    console.log("Deploying lottery contract");

    const lotteryFactory = new Lottery__factory(signer);
    contract = await lotteryFactory.deploy(
        "LotteryToken",
        "LT0",
        TOKEN_RATIO,
        ethers.utils.parseEther(BET_PRICE.toFixed(18)),
        ethers.utils.parseEther(BET_FEE.toFixed(18))
    ) as Lottery;
    await contract.deployed();

    const tokenAddress = await contract.paymentToken();
    const tokenFactory = new LotteryToken__factory(signer);
    token = tokenFactory.attach(tokenAddress);

    console.log(
        `The lottery contract was deployed at the address ${contract.address}`
    );

    console.log(
        `The token contract was deployed at the address ${tokenAddress}`
    );
}

async function mainMenu(rl: readline.Interface) {
    menuOptions(rl);
}

function menuOptions(rl: readline.Interface) {
    rl.question(
        "Select operation: \n Options: \n [0]: Exit \n [1]: Check state \n [2]: Open bets \n [5]: Close bets \n [7]: Withdraw \n",
        async (answer: string) => {
            console.log(`Selected: ${answer}\n`);
            const option = Number(answer);
            switch (option) {
                case 0:
                    rl.close();
                    return;
                case 1:
                    await checkState();
                    mainMenu(rl);
                    break;
                case 2:
                    rl.question("Input duration (in seconds)\n", async (duration) => {
                        try {
                            await openBets(duration);
                        } catch (error) {
                            console.log("error\n");
                            console.log({ error });
                        }
                        mainMenu(rl);
                    });
                    break;
                case 5:
                    try {
                        await closeLottery();
                    } catch (error) {
                        console.log("error\n");
                        console.log({ error });
                    }
                    mainMenu(rl);
                    break;
                case 7:
                    await displayOwnerTokenBalance();
                    await displayOwnerPool();
                    rl.question("Withdraw how many tokens?\n", async (amount) => {
                        try {
                            await withdrawTokens(amount);
                        } catch (error) {
                            console.log("error\n");
                            console.log({ error });
                        }
                        mainMenu(rl);
                    });
                    break;
                default:
                    throw new Error("Invalid option");
            }
        }
    );
}

async function checkState() {
    const state = await contract.betsOpen();
    console.log(`The lottery is ${state ? "open" : "closed"}\n`);
    if (!state) return;
    const currentBlock = await provider.getBlock("latest");
    const currentBlockDate = new Date(currentBlock.timestamp * 1000);
    const closingTime = await contract.betsClosingTime();
    const closingTimeDate = new Date(closingTime.toNumber() * 1000);
    console.log(
        `The last block was mined at ${currentBlockDate.toLocaleDateString()} : ${currentBlockDate.toLocaleTimeString()}\n`
    );
    console.log(
        `lottery should close at ${closingTimeDate.toLocaleDateString()} : ${closingTimeDate.toLocaleTimeString()}\n`
    );
}

async function openBets(duration: string) {
    const currentBlock = await provider.getBlock("latest");
    const tx = await contract.openBets(currentBlock.timestamp + Number(duration));
    const receipt = await tx.wait();
    console.log(`Bets opened (${receipt.transactionHash})`);
}

async function closeLottery() {
    const tx = await contract.closeLottery();
    const receipt = await tx.wait();
    console.log(`Bets closed (${receipt.transactionHash})\n`);
}

async function displayOwnerTokenBalance() {
    const balanceBN = await token.balanceOf(wallet.address);
    const balance = ethers.utils.formatEther(balanceBN);
    console.log(
      `The account of address ${wallet.address
      } has ${balance} LT0\n`
    );
  }

async function displayOwnerPool() {
    const balanceBN = await contract.ownerPool();
    const balance = ethers.utils.formatEther(balanceBN);
    console.log(`The owner pool has (${balance}) Tokens \n`);
}

async function withdrawTokens(amount: string) {
    const tx = await contract.ownerWithdraw(ethers.utils.parseEther(amount));
    const receipt = await tx.wait();
    console.log(`Withdraw confirmed (${receipt.transactionHash})\n`);
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});