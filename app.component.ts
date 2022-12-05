import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ethers } from 'ethers';

import lotteryJson from '../assets/Lottery.json';
import tokenJson from '../assets/LotteryToken.json';

import { environment } from 'src/environments/environment';

export class claimTokensDTO {
  constructor(public address: string, public amount: string) {
  }
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  provider: ethers.providers.Provider;
  wallet: ethers.Wallet | undefined;
  signer: ethers.Signer | undefined;

  lotteryContract: ethers.Contract | undefined;
  tokenContract: ethers.Contract | undefined;

  lotteryAddress: string;
  tokenAddress: string;

  ethBalance: number | string | undefined;
  tokenBalance: number | string | undefined;
  prizeBalance: number | string | undefined;

  purchaseRatio: number | undefined;
  betPrice: number | undefined;
  betFee: number | undefined;

  lotteryState: string | undefined;
  currentBlockDateString: string | undefined;
  closingTimeDateString: string | undefined;

  buyError: string | undefined;
  betError: string | undefined;
  closeError: string | undefined;
  claimError: string | undefined;
  burnError: string | undefined;

  constructor(private http: HttpClient) {
    this.provider = ethers.getDefaultProvider("goerli", {
      etherscan: environment['ETHERSCAN_API_KEY'],
      infura: environment['INFURA_API_KEY'],
      alchemy: environment['ALCHEMY_API_KEY']
    });

    this.lotteryAddress = "NO LOTTERY CONNECTED";
    this.tokenAddress = "NO TOKEN CONNECTED";

    this.purchaseRatio = 0;
    this.betPrice = 0;
    this.betFee = 0;
  }

  createWallet() {
    this.wallet = ethers.Wallet.createRandom();

    this.signer = this.wallet.connect(this.provider);

    this.updateValues();
  }

  importWallet(privateKey: string) {
    // TODO (optional): make this.wallet to be imported from the privateKey or mnemonic seed

    this.updateValues();
  }

  updateValues() {
    [this.ethBalance, this.tokenBalance, this.prizeBalance] = ["LOADING...", "LOADING...", "LOADING..."];
    this.signer?.getBalance().then((balanceBN) => {
      this.ethBalance = parseFloat(ethers.utils.formatEther(balanceBN));
    })

    if (this.tokenContract) {
      this.tokenContract["balanceOf"](this.wallet?.address).then((balanceBN: ethers.BigNumberish) => {
        this.tokenBalance = parseFloat(ethers.utils.formatEther(balanceBN));
      });
    } else {
      this.tokenBalance = "NO TOKEN CONNECTED";
    }

    if (this.lotteryContract) {
      this.lotteryContract["prize"](this.wallet?.address).then((prizeBN: ethers.BigNumberish) => {
        this.prizeBalance = parseFloat(ethers.utils.formatEther(prizeBN));
      });

      [this.lotteryState, this.currentBlockDateString, this.closingTimeDateString] = ["LOADING...", "LOADING...", "LOADING..."];

      this.lotteryContract["betsOpen"]().then((state: boolean) => {
        this.lotteryState = state ? "OPEN" : "CLOSED";

        if (this.lotteryContract && state) {
          this.lotteryContract["betsClosingTime"]().then((closingTime: ethers.BigNumber) => {
            const closingTimeDate = new Date(closingTime.toNumber() * 1000);
            this.closingTimeDateString = `${closingTimeDate.toLocaleDateString()} : ${closingTimeDate.toLocaleTimeString()}`;
          });
        } else {
          this.closingTimeDateString = "CLOSED";
        }
      });

      this.provider.getBlock("latest").then((currentBlock) => {
        const currentBlockDate = new Date(currentBlock.timestamp * 1000);
        this.currentBlockDateString = `${currentBlockDate.toLocaleDateString()} : ${currentBlockDate.toLocaleTimeString()}`;
      });

    } else {
      this.prizeBalance = "NO LOTTERY CONNECTED";
    }
  }

  connectLottery(lotteryAddress: string) {
    this.lotteryAddress = lotteryAddress;
    this.lotteryContract = new ethers.Contract(lotteryAddress, lotteryJson.abi, this.signer);

    this.lotteryContract["purchaseRatio"]().then((purchaseRatio: ethers.BigNumber) => {
      this.purchaseRatio = purchaseRatio.toNumber();
    });

    this.lotteryContract["betPrice"]().then((betPrice: ethers.BigNumber) => {
      this.betPrice = Number.parseFloat(ethers.utils.formatEther(betPrice));
    });

    this.lotteryContract["betFee"]().then((betFee: ethers.BigNumber) => {
      this.betFee = Number.parseFloat(ethers.utils.formatEther(betFee));
    });

    this.lotteryContract["paymentToken"]().then((tokenAddress: string) => {
      this.tokenAddress = tokenAddress;
      this.tokenContract = new ethers.Contract(tokenAddress, tokenJson.abi, this.signer);

      this.updateValues();
    });

    this.updateValues();
  }

  buyTokens(amount: string) {
    this.buyError = undefined;

    if (!amount) amount = '0';

    if (this.lotteryContract && this.purchaseRatio) {
      this.lotteryContract["purchaseTokens"]({
        value: ethers.utils.parseEther(amount).div(this.purchaseRatio),
      }).then(
        () => {
          this.updateValues();
        },
        (reason: string) => {
          this.buyError = "BUY ERROR";
          console.log(reason);
        }
      );
    }
  }

  bet(amount: string) {
    this.betError = undefined;

    if (!amount) amount = '0';

    if (this.lotteryContract && this.tokenContract) {
      this.tokenContract["approve"](this.lotteryAddress, ethers.constants.MaxUint256).then(
        () => {
          if (this.lotteryContract) {
            this.lotteryContract["betMany"](amount).then(
              () => {
                this.updateValues();
              },
              (reason: string) => {
                this.betError = "BET ERROR";
                console.log(reason);
              }
            );
          }
        },
        (reason: string) => {
          this.betError = "APPROVE ERROR"

        }
      );
    }
  }

  closeLottery() {
    this.closeError = undefined;

    if (this.lotteryContract) {
      this.lotteryContract["closeLottery"]().then(
        () => {
          this.updateValues();
        },
        (reason: string) => {
          this.closeError = "CLOSE ERROR";
        }
      );
    }
  }

  claimPrize(amount: string) {
    this.claimError = undefined;

    if (!amount) amount = '0';

    if (this.lotteryContract) {
      this.lotteryContract["prizeWithdraw"](ethers.utils.parseEther(amount)).then(
        () => {
          this.updateValues();
        },
        (reason: string) => {
          this.claimError = "CLAIM ERROR";
          console.log(reason);
        }
      );
    }
  }

  burnTokens(amount: string) {
    this.burnError = undefined;

    if (!amount) amount = '0';

    if (this.lotteryContract && this.tokenContract) {
      this.tokenContract["approve"](this.lotteryAddress, ethers.constants.MaxUint256).then(
        () => {
          if (this.lotteryContract) {
            this.lotteryContract["returnTokens"](ethers.utils.parseEther(amount)).then(
              () => {
                this.updateValues();
              },
              (reason: string) => {
                this.burnError = "BURN ERROR";
                console.log(reason);
              }
            );
          }
        },
        (reason: string) => {
          this.betError = "APPROVE ERROR";
          console.log(reason);
        }
      );
    }
  }

}
